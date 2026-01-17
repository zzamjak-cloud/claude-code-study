// 일정 그리드 컴포넌트 (Phase 2: 드래그 앤 드롭 + Ctrl+드래그 일정 생성)

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { YEAR_DAYS } from '../../lib/constants/grid'
import { getCellWidth, getCellHeight } from '../../lib/utils/gridUtils'
import { DateAxis } from './DateAxis'
import { GridCell } from './GridCell'
import { ScheduleCard } from './ScheduleCard'
import { MemberMemo } from './MemberMemo'
import { Announcement } from '../layout/Announcement'
import { GlobalEventCard } from './GlobalEventCard'
import { getVisibleDayIndices, getVisibleScheduleSegments } from '../../lib/utils/dateUtils'
import { createSchedule as createScheduleFirebase, updateTeamMember, createGlobalEvent, updateGlobalEventSettings } from '../../lib/firebase/firestore'
import { DEFAULT_SCHEDULE_COLOR, GLOBAL_EVENT_COLOR, ANNUAL_LEAVE_COLOR } from '../../lib/constants/colors'
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
    isAdmin,
    globalEvents,
    globalEventRowCount,
    monthVisibility,
    selectedProjectId,
    projects,
    columnWidthScale,
    pushHistory,
  } = useAppStore()
  const cellWidth = getCellWidth(zoomLevel, columnWidthScale)
  const cellHeight = getCellHeight(zoomLevel)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fixedColumnRef = useRef<HTMLDivElement>(null)

  // 표시할 날짜 인덱스 (숨겨진 월 제외)
  const visibleDayIndices = useMemo(
    () => getVisibleDayIndices(currentYear, monthVisibility),
    [currentYear, monthVisibility]
  )

  // 표시할 날짜 수
  const visibleDayCount = visibleDayIndices.length

  // 원본 인덱스 → 표시 인덱스 변환 맵
  const dayIndexToVisibleIndex = useMemo(() => {
    const map: Record<number, number> = {}
    visibleDayIndices.forEach((originalIndex, visibleIndex) => {
      map[originalIndex] = visibleIndex
    })
    return map
  }, [visibleDayIndices])

  // 월 첫 날 인덱스 Set (월 구분선 표시용)
  const firstDayOfMonthIndices = useMemo(() => {
    const yearStart = new Date(currentYear, 0, 1)
    const set = new Set<number>()
    let prevMonth = -1

    visibleDayIndices.forEach((dayIndex) => {
      const date = addDays(yearStart, dayIndex)
      const month = date.getMonth()
      if (month !== prevMonth) {
        set.add(dayIndex)
        prevMonth = month
      }
    })

    return set
  }, [visibleDayIndices, currentYear])

  // 일정 생성 상태 (Ctrl + 드래그)
  const [isCreating, setIsCreating] = useState(false)
  const [createMemberId, setCreateMemberId] = useState<string | null>(null)
  const [createRowIndex, setCreateRowIndex] = useState<number>(0)
  const [createStart, setCreateStart] = useState<number | null>(null)
  const [createEnd, setCreateEnd] = useState<number | null>(null)
  const [isAnnualLeave, setIsAnnualLeave] = useState(false)  // Alt 키로 연차 카드 생성

  // 글로벌 이벤트 생성 상태
  const [isCreatingGlobal, setIsCreatingGlobal] = useState(false)
  const [createGlobalRowIndex, setCreateGlobalRowIndex] = useState<number>(0)
  const [createGlobalStart, setCreateGlobalStart] = useState<number | null>(null)
  const [createGlobalEnd, setCreateGlobalEnd] = useState<number | null>(null)

  // 구성원별 행 수 관리
  const [memberRowCounts, setMemberRowCounts] = useState<Record<string, number>>({})

  // 하단 패널 높이 (리사이즈 가능)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
    const saved = localStorage.getItem('bottomPanelHeight')
    return saved ? parseInt(saved, 10) : 160
  })
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const panelHeightRef = useRef(bottomPanelHeight) // 리사이즈 중 현재 높이 추적용

  // 통합 탭 여부
  const isUnifiedTab = selectedMemberId === null

  // 고정 열 너비 (통합 탭, 개별 탭 동일하게 75px)
  const fixedColumnWidth = 75

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

  // 하단 패널 리사이즈 핸들러
  const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingPanel(true)
    const startY = e.clientY
    const startHeight = panelHeightRef.current

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY
      const newHeight = Math.min(400, Math.max(100, startHeight + deltaY))
      panelHeightRef.current = newHeight
      setBottomPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizingPanel(false)
      localStorage.setItem('bottomPanelHeight', panelHeightRef.current.toString())
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  // 패널 높이 변경 시 localStorage 저장
  useEffect(() => {
    if (!isResizingPanel) {
      localStorage.setItem('bottomPanelHeight', bottomPanelHeight.toString())
    }
  }, [bottomPanelHeight, isResizingPanel])

  // 구성원의 행 수 가져오기 (기본 1)
  const getRowCount = (memberId: string) => {
    const member = members.find((m) => m.id === memberId)
    return member?.rowCount || memberRowCounts[memberId] || 1
  }

  // 행 추가
  const addRow = async (memberId: string) => {
    const previousRowCount = getRowCount(memberId)
    const newCount = previousRowCount + 1
    setMemberRowCounts((prev) => ({
      ...prev,
      [memberId]: newCount,
    }))

    // Firebase 업데이트
    if (workspaceId) {
      try {
        await updateTeamMember(workspaceId, memberId, { rowCount: newCount })
        // 히스토리 기록
        const member = members.find((m) => m.id === memberId)
        pushHistory({
          type: 'member_row_change',
          description: `${member?.name || '구성원'} 행 추가`,
          undoData: { memberId, previousRowCount },
          redoData: { memberId, newRowCount: newCount },
        })
      } catch (error) {
        console.error('행 추가 실패:', error)
      }
    }
  }

  // 행 제거
  const removeRow = async (memberId: string) => {
    const currentRowCount = getRowCount(memberId)
    if (currentRowCount <= 1) return // 최소 1행 유지

    const lastRowIndex = currentRowCount - 1

    // 마지막 행에 카드가 있는지 확인
    const hasCardsInLastRow = schedules.some(
      (s) => s.memberId === memberId && (s.rowIndex || 0) === lastRowIndex
    )

    if (hasCardsInLastRow) {
      alert('카드가 등록된 행은 삭제할 수 없습니다.')
      return
    }

    const newCount = currentRowCount - 1
    setMemberRowCounts((prev) => ({
      ...prev,
      [memberId]: newCount,
    }))

    // Firebase 업데이트
    if (workspaceId) {
      try {
        await updateTeamMember(workspaceId, memberId, { rowCount: newCount })
        // 히스토리 기록
        const member = members.find((m) => m.id === memberId)
        pushHistory({
          type: 'member_row_change',
          description: `${member?.name || '구성원'} 행 제거`,
          undoData: { memberId, previousRowCount: currentRowCount },
          redoData: { memberId, newRowCount: newCount },
        })
      } catch (error) {
        console.error('행 제거 실패:', error)
      }
    }
  }

  // 글로벌 행 추가 (관리자 + 통합 탭에서만)
  const addGlobalRow = async () => {
    if (!workspaceId || !isAdmin || !isUnifiedTab) return
    const previousRowCount = globalEventRowCount
    const newCount = previousRowCount + 1
    try {
      await updateGlobalEventSettings(workspaceId, { rowCount: newCount })
      // 히스토리 기록
      pushHistory({
        type: 'global_row_change',
        description: '특이사항 행 추가',
        undoData: { previousRowCount },
        redoData: { newRowCount: newCount },
      })
    } catch (error) {
      console.error('글로벌 행 추가 실패:', error)
    }
  }

  // 글로벌 행 제거 (관리자 + 통합 탭에서만)
  const removeGlobalRow = async () => {
    if (!workspaceId || !isAdmin || !isUnifiedTab) return
    const previousRowCount = globalEventRowCount
    const newCount = Math.max(1, previousRowCount - 1)
    try {
      await updateGlobalEventSettings(workspaceId, { rowCount: newCount })
      // 히스토리 기록
      pushHistory({
        type: 'global_row_change',
        description: '특이사항 행 제거',
        undoData: { previousRowCount },
        redoData: { newRowCount: newCount },
      })
    } catch (error) {
      console.error('글로벌 행 제거 실패:', error)
    }
  }

  // 현재 선택된 탭의 일정만 필터링
  const filteredSchedules = selectedMemberId
    ? schedules.filter((s) => s.memberId === selectedMemberId)
    : schedules

  // 선택된 프로젝트의 글로벌 이벤트만 필터링 (projectId가 없는 이벤트는 전역으로 모든 프로젝트에 표시)
  const filteredGlobalEvents = useMemo(() => {
    if (!selectedProjectId) return globalEvents
    return globalEvents.filter((e) => !e.projectId || e.projectId === selectedProjectId)
  }, [globalEvents, selectedProjectId])

  // 글로벌 행 데이터 생성
  const generateGlobalRows = () => {
    const rows: Array<{
      rowIndex: number
      events: typeof globalEvents
      isFirstRow: boolean
      isLastRow: boolean
      totalRows: number
    }> = []

    for (let i = 0; i < globalEventRowCount; i++) {
      rows.push({
        rowIndex: i,
        events: filteredGlobalEvents.filter((e) => (e.rowIndex || 0) === i),
        isFirstRow: i === 0,
        isLastRow: i === globalEventRowCount - 1,
        totalRows: globalEventRowCount,
      })
    }

    return rows
  }

  const globalRows = generateGlobalRows()

  // 행 데이터 생성
  const generateRows = () => {
    if (isUnifiedTab) {
      // 통합 탭: 각 구성원별로 카드가 있는 행만 생성 (기본 1행은 항상 표시)
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

      // 숨긴 구성원 제외 + 프로젝트 필터링
      let visibleMembers = members.filter((m) => !m.isHidden)

      // 선택된 프로젝트가 있으면 해당 프로젝트에 속한 구성원만 표시
      if (selectedProjectId) {
        const project = projects.find((p) => p.id === selectedProjectId)
        if (project && project.memberIds) {
          visibleMembers = visibleMembers.filter((m) => project.memberIds.includes(m.id))
        }
      }

      visibleMembers.forEach((m) => {
        const memberSchedules = schedules.filter((s) => s.memberId === m.id)

        // 카드가 있는 행 인덱스 수집
        const rowsWithCards = new Set<number>()
        memberSchedules.forEach((s) => {
          rowsWithCards.add(s.rowIndex || 0)
        })

        // 기본 0행은 항상 포함
        rowsWithCards.add(0)

        // 정렬된 행 인덱스 배열
        const sortedRowIndices = Array.from(rowsWithCards).sort((a, b) => a - b)
        const totalRows = sortedRowIndices.length

        sortedRowIndices.forEach((rowIdx, displayIndex) => {
          rows.push({
            memberId: m.id,
            memberName: m.name,
            memberColor: m.color,
            rowIndex: rowIdx,
            schedules: memberSchedules.filter((s) => (s.rowIndex || 0) === rowIdx),
            isFirstRow: displayIndex === 0,
            isLastRow: displayIndex === totalRows - 1,
            totalRows: totalRows,
          })
        })
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
          memberName: member?.name || '',
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
    const color = isLeave ? ANNUAL_LEAVE_COLOR : (selectedScheduleColor || DEFAULT_SCHEDULE_COLOR)
    const title = isLeave ? '연차' : ''

    // 즉시 상태 초기화 (점선 미리보기 즉시 제거)
    resetCreation()

    // Firebase에 일정 생성 (비동기, 상태 초기화 후 실행)
    if (workspaceId && currentUser) {
      try {
        const scheduleData = {
          memberId: memberId,
          title: title,
          startDate: startDate.getTime(),
          endDate: endDate.getTime(),
          color: color,
          rowIndex: rowIndex,
          createdBy: currentUser.uid,
        }
        const scheduleId = await createScheduleFirebase(workspaceId, scheduleData)

        // 히스토리 기록
        const member = members.find((m) => m.id === memberId)
        pushHistory({
          type: 'schedule_create',
          description: `${member?.name || '구성원'} 일정 생성`,
          undoData: { scheduleId },
          redoData: { schedule: scheduleData },
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

  // 글로벌 이벤트 생성 상태 초기화
  const resetGlobalCreation = () => {
    setIsCreatingGlobal(false)
    setCreateGlobalRowIndex(0)
    setCreateGlobalStart(null)
    setCreateGlobalEnd(null)
  }

  // 글로벌 행에서 마우스 다운: Ctrl + 드래그로 글로벌 이벤트 생성 (통합 탭 + 관리자만)
  const handleGlobalMouseDown = (e: React.MouseEvent, rowIndex: number) => {
    // 통합 탭 + 관리자만 생성 가능
    if (!isUnifiedTab || !isAdmin) return

    // Ctrl 키가 눌려있지 않으면 무시
    const isCtrl = e.ctrlKey || e.metaKey
    if (!isCtrl) return

    // 이미 존재하는 카드 위에서 시작하면 무시
    if ((e.target as HTMLElement).closest('.global-event-card')) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const dayIndex = Math.floor(x / cellWidth)

    setIsCreatingGlobal(true)
    setCreateGlobalRowIndex(rowIndex)
    setCreateGlobalStart(dayIndex)
    setCreateGlobalEnd(dayIndex)

    e.preventDefault()
  }

  // 글로벌 행에서 마우스 이동
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (!isCreatingGlobal || createGlobalStart === null) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const dayIndex = Math.max(0, Math.min(YEAR_DAYS - 1, Math.floor(x / cellWidth)))

    setCreateGlobalEnd(dayIndex)
  }

  // 글로벌 행에서 마우스 업: 글로벌 이벤트 생성
  const handleGlobalMouseUp = async () => {
    if (!isCreatingGlobal) return

    if (createGlobalStart === null || createGlobalEnd === null) {
      resetGlobalCreation()
      return
    }

    const startDay = Math.min(createGlobalStart, createGlobalEnd)
    const endDay = Math.max(createGlobalStart, createGlobalEnd)

    if (endDay - startDay < 0) {
      resetGlobalCreation()
      return
    }

    const yearStart = new Date(currentYear, 0, 1)
    const startDate = addDays(yearStart, startDay)
    const endDate = addDays(yearStart, endDay + 1)

    const rowIndex = createGlobalRowIndex

    resetGlobalCreation()

    if (workspaceId && currentUser && selectedProjectId) {
      try {
        const eventData = {
          projectId: selectedProjectId,
          title: '',
          startDate: startDate.getTime(),
          endDate: endDate.getTime(),
          color: GLOBAL_EVENT_COLOR,
          rowIndex: rowIndex,
          createdBy: currentUser.uid,
        }
        const eventId = await createGlobalEvent(workspaceId, eventData)

        // 히스토리 기록
        pushHistory({
          type: 'global_event_create',
          description: '특이사항 생성',
          undoData: { eventId },
          redoData: { event: eventData },
        })
      } catch (error) {
        console.error('글로벌 이벤트 생성 실패:', error)
      }
    }
  }

  // 글로벌 이벤트 생성 미리보기 계산
  const getGlobalCreationPreview = (rowIndex: number) => {
    if (
      !isCreatingGlobal ||
      createGlobalRowIndex !== rowIndex ||
      createGlobalStart === null ||
      createGlobalEnd === null
    ) {
      return null
    }

    const startDay = Math.min(createGlobalStart, createGlobalEnd)
    const endDay = Math.max(createGlobalStart, createGlobalEnd)

    return {
      x: startDay * cellWidth,
      width: (endDay - startDay + 1) * cellWidth,
    }
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 상단: 그리드 영역 */}
      <div className="flex-1 flex overflow-hidden">

      {/* 고정 열 (구성원 이름 또는 빈 영역) */}
      <div
        ref={fixedColumnRef}
        className="flex-shrink-0 overflow-y-auto overflow-x-hidden bg-card border-r border-border scrollbar-none"
        style={{ width: `${fixedColumnWidth}px` }}
      >
        {/* 고정 열 헤더 (날짜 축과 동일 - sticky) */}
        {/* 월 헤더 24px + 날짜 행 20px + 공휴일 행 16px = 60px */}
        <div
          className="sticky top-0 z-20 flex items-center justify-center bg-card border-b border-border text-sm text-muted-foreground"
          style={{ height: '60px' }}
        />

        {/* 글로벌 특이사항 행 - 고정 열 */}
        {globalRows.map((row) => (
          <div
            key={`fixed-global-${row.rowIndex}`}
            className={`flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 ${
              row.isLastRow ? 'border-b-2 border-amber-400' : ''
            }`}
            style={{ height: `${cellHeight}px` }}
          >
            {row.isFirstRow && globalRows.length === 1 ? (
              // 행이 1개일 때: 텍스트 + 버튼
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 truncate text-center">
                  특이사항
                </span>
                {isUnifiedTab && isAdmin && (
                  <button
                    onClick={addGlobalRow}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-600 transition-colors font-bold"
                    title="특이사항 행 추가"
                  >
                    +
                  </button>
                )}
              </div>
            ) : row.isFirstRow ? (
              // 첫 번째 행 (다중 행일 때): 텍스트만
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400 truncate text-center px-1">
                특이사항
              </span>
            ) : row.isLastRow && isUnifiedTab && isAdmin ? (
              // 마지막 행 (다중 행일 때): +/- 버튼
              <div className="flex items-center gap-1">
                <button
                  onClick={addGlobalRow}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-600 transition-colors font-bold px-1"
                  title="특이사항 행 추가"
                >
                  +
                </button>
                <button
                  onClick={removeGlobalRow}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:text-red-500 transition-colors font-bold px-1"
                  title="특이사항 행 제거"
                >
                  -
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {/* 구성원 행 */}
        {rows.map((row) => (
          <div
            key={`fixed-${row.memberId}-${row.rowIndex}`}
            className={`flex items-center justify-center ${
              row.isLastRow ? 'border-b border-border' : ''
            }`}
            style={{ height: `${cellHeight}px` }}
          >
            {!isUnifiedTab && row.isFirstRow && row.totalRows === 1 ? (
              // 개별 탭, 행이 1개일 때: 이름 + 버튼
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-foreground truncate text-center">
                  {row.memberName}
                </span>
                <button
                  onClick={() => addRow(row.memberId)}
                  className="text-xs text-foreground hover:text-primary transition-colors font-bold"
                  title="행 추가"
                >
                  +
                </button>
              </div>
            ) : !isUnifiedTab && row.isFirstRow ? (
              // 개별 탭, 첫 번째 행 (다중 행일 때): 이름만
              <span className="text-xs font-medium text-foreground truncate text-center px-1">
                {row.memberName}
              </span>
            ) : !isUnifiedTab && row.isLastRow ? (
              // 개별 탭, 마지막 행 (다중 행일 때): +/- 버튼
              <div className="flex items-center gap-1">
                <button
                  onClick={() => addRow(row.memberId)}
                  className="text-xs text-foreground hover:text-primary transition-colors font-bold px-1"
                  title="행 추가"
                >
                  +
                </button>
                <button
                  onClick={() => removeRow(row.memberId)}
                  className="text-xs text-foreground hover:text-destructive transition-colors font-bold px-1"
                  title="행 제거"
                >
                  -
                </button>
              </div>
            ) : row.isFirstRow ? (
              // 통합 탭: 이름만
              <span className="text-xs font-medium text-foreground truncate text-center px-1">
                {row.memberName}
              </span>
            ) : null}
          </div>
        ))}

        {/* 구성원이 없을 때 빈 공간 */}
        {rows.length === 0 && (
          <div style={{ height: '256px' }} />
        )}
      </div>

      {/* 스크롤 가능한 그리드 영역 (날짜 축 포함) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto scrollbar-thin"
      >
        <div style={{ width: `${visibleDayCount * cellWidth}px` }}>
          {/* 날짜 축 - sticky로 상단 고정 */}
          <div className="sticky top-0 z-30 bg-card border-b border-border">
            <DateAxis hideFixedColumn />
          </div>

          {/* 글로벌 특이사항 행 - 그리드 */}
          {globalRows.map((row) => {
            const globalPreview = getGlobalCreationPreview(row.rowIndex)
            // 통합 탭 + 관리자만 편집 가능
            const isGlobalReadOnly = !isUnifiedTab || !isAdmin

            return (
              <div
                key={`grid-global-${row.rowIndex}`}
                className="relative bg-amber-50/50 dark:bg-amber-900/10"
                style={{ height: `${cellHeight}px` }}
                onMouseDown={(e) => handleGlobalMouseDown(e, row.rowIndex)}
                onMouseMove={handleGlobalMouseMove}
                onMouseUp={handleGlobalMouseUp}
                onMouseLeave={() => {
                  if (isCreatingGlobal) resetGlobalCreation()
                }}
              >
                {/* 그리드 셀 배경 */}
                <div className="flex absolute inset-0">
                  {visibleDayIndices.map((dayIndex) => (
                    <GridCell key={dayIndex} dayIndex={dayIndex} isFirstDayOfMonth={firstDayOfMonthIndices.has(dayIndex)} />
                  ))}
                </div>

                {/* 특이사항 하단 노란 구분선 (z-index로 셀 배경 위에 표시) */}
                {row.isLastRow && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 z-20" />
                )}

                {/* 생성 중인 글로벌 이벤트 미리보기 */}
                {globalPreview && (
                  <div
                    className="absolute top-1 rounded-md border-2 border-dashed border-amber-500 bg-amber-500/20 pointer-events-none z-30"
                    style={{
                      left: `${globalPreview.x}px`,
                      width: `${globalPreview.width}px`,
                      height: `${cellHeight - 8}px`,
                    }}
                  />
                )}

                {/* 글로벌 이벤트 카드 */}
                {row.events.map((event) => {
                  // 이벤트가 표시될 세그먼트 계산
                  const segments = getVisibleScheduleSegments(
                    new Date(event.startDate),
                    new Date(event.endDate),
                    currentYear,
                    monthVisibility
                  )
                  // 세그먼트가 없으면 (모든 날짜가 숨겨진 월에 있으면) 렌더링 안 함
                  if (segments.length === 0) return null

                  // 첫 번째 표시 가능한 세그먼트 사용
                  const firstSegment = segments[0]
                  const visibleStartIndex = dayIndexToVisibleIndex[firstSegment.startDayIndex]
                  if (visibleStartIndex === undefined) return null

                  const eventX = visibleStartIndex * cellWidth

                  // 표시할 날짜 수 계산 (모든 표시 가능한 세그먼트의 합)
                  let totalVisibleDays = 0
                  for (const seg of segments) {
                    for (let d = seg.startDayIndex; d < seg.endDayIndex; d++) {
                      if (dayIndexToVisibleIndex[d] !== undefined) {
                        totalVisibleDays++
                      }
                    }
                  }

                  return (
                    <GlobalEventCard
                      key={event.id}
                      event={event}
                      x={eventX}
                      isReadOnly={isGlobalReadOnly}
                      totalRows={row.totalRows}
                      visibleWidth={totalVisibleDays * cellWidth}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* 그리드 행 */}
          {rows.map((row) => {
            const preview = getCreationPreview(row.memberId, row.rowIndex)

            return (
              <div
                key={`grid-${row.memberId}-${row.rowIndex}`}
                className={`relative ${
                  row.isLastRow ? 'border-b border-border' : ''
                }`}
                style={{ height: `${cellHeight}px` }}
                onMouseDown={(e) => handleMouseDown(e, row.memberId, row.rowIndex)}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  if (isCreating) resetCreation()
                }}
              >
                {/* 그리드 셀 배경 */}
                <div className="flex absolute inset-0">
                  {visibleDayIndices.map((dayIndex) => (
                    <GridCell key={dayIndex} dayIndex={dayIndex} isFirstDayOfMonth={firstDayOfMonthIndices.has(dayIndex)} />
                  ))}
                </div>

                {/* 생성 중인 일정 미리보기 */}
                {preview && (
                  <div
                    className="absolute top-1 rounded-md border-2 border-dashed border-primary bg-primary/20 pointer-events-none z-30"
                    style={{
                      left: `${preview.x}px`,
                      width: `${preview.width}px`,
                      height: `${cellHeight - 8}px`,
                    }}
                  />
                )}

                {/* 일정 카드 */}
                {row.schedules.map((schedule) => {
                  // 일정이 표시될 세그먼트 계산
                  const segments = getVisibleScheduleSegments(
                    new Date(schedule.startDate),
                    new Date(schedule.endDate),
                    currentYear,
                    monthVisibility
                  )
                  // 세그먼트가 없으면 (모든 날짜가 숨겨진 월에 있으면) 렌더링 안 함
                  if (segments.length === 0) return null

                  // 첫 번째 표시 가능한 세그먼트 사용
                  const firstSegment = segments[0]
                  const visibleStartIndex = dayIndexToVisibleIndex[firstSegment.startDayIndex]
                  if (visibleStartIndex === undefined) return null

                  const x = visibleStartIndex * cellWidth

                  // 표시할 날짜 수 계산 (모든 표시 가능한 세그먼트의 합)
                  let totalVisibleDays = 0
                  for (const seg of segments) {
                    for (let d = seg.startDayIndex; d < seg.endDayIndex; d++) {
                      if (dayIndexToVisibleIndex[d] !== undefined) {
                        totalVisibleDays++
                      }
                    }
                  }

                  return (
                    <ScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      x={x}
                      isReadOnly={isUnifiedTab}
                      totalRows={row.totalRows}
                      visibleWidth={totalVisibleDays * cellWidth}
                      onRowChange={isUnifiedTab ? undefined : async (_newRowIndex) => {
                        // 행 변경 로직은 ScheduleCard에서 처리
                      }}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* 구성원이 없을 때 */}
          {rows.length === 0 && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>구성원을 추가하여 일정을 관리하세요.</p>
            </div>
          )}

        </div>
      </div>
      </div>

      {/* 하단: 고정 패널 - 공지사항 | 메모 (개별 탭에서만 표시) */}
      {!isUnifiedTab && selectedMemberId && (
        <div className="flex-shrink-0 flex flex-col border-t border-border bg-card">
          {/* 리사이즈 핸들 */}
          <div
            onMouseDown={handlePanelResizeStart}
            className={`h-1.5 cursor-ns-resize hover:bg-primary/30 transition-colors flex items-center justify-center group ${
              isResizingPanel ? 'bg-primary/30' : 'bg-transparent'
            }`}
          >
            <div className="w-12 h-1 bg-border group-hover:bg-primary/50 rounded-full" />
          </div>

          {/* 패널 내용 */}
          <div className="flex" style={{ height: `${bottomPanelHeight}px` }}>
            {/* 공지사항 */}
            <div className="flex-1 border-r border-border">
              <Announcement />
            </div>
            {/* 메모 */}
            <div className="flex-1">
              <MemberMemo memberId={selectedMemberId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
